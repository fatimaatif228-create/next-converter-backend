const {
  Injectable,
  Dependencies,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { EMAIL_SERVICE } = require('../email/email.tokens');
const { SupabaseDbService } = require('../../supabase/supabase-db.service');
const { conversionCompleteEmail, conversionFailedEmail } = require('../email/templates');
const { getQueueToken } = require('@nestjs/bullmq');
const { createClient } = require('@supabase/supabase-js');
const { SubscriptionsService } = require('../subscriptions/subscriptions.service');

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const CONVERSION_QUEUE_NAME = 'conversion';
const UPLOADS_BUCKET = 'uploads';
const OUTPUTS_BUCKET = 'outputs';
const CONVERSIONS_TABLE = 'conversions';
const CONVERSION_LOGS_TABLE = 'conversion_logs';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-process stand-in for a BullMQ worker/processor. There's no message
 * queue or Redis here — a single in-memory retry loop plays the same role
 * a queue's job lifecycle would. This is intentionally simpler than a real
 * queue and won't survive a server restart mid-job, and won't work across
 * multiple server instances — if that's ever needed, this is the piece to
 * swap back for a real queue (BullMQ + Redis, or similar).
 *
 * NOTE ON SCOPE: there is no `projects` table in Supabase yet (only
 * `users`), so "project" data (name, id, output info) is carried directly
 * on the job payload rather than looked up via a join. The owner's email
 * is still fetched live from `users` via SupabaseDbService.
 */
@Injectable()
@Dependencies(
  EMAIL_SERVICE,
  SupabaseDbService,
  ConfigService,
  getQueueToken(CONVERSION_QUEUE_NAME),
  SubscriptionsService,
)
export class ConversionsService {
  constructor(emailService, supabaseDbService, configService, conversionQueue, subscriptionsService) {
    this.emailService = emailService;
    this.supabaseDbService = supabaseDbService;
    this.configService = configService;
    this.conversionQueue = conversionQueue;
    this.subscriptionsService = subscriptionsService;
    this.logger = new Logger(ConversionsService.name);
  }

  async getConversionRecord({ conversionId, userId }) {
    if (!conversionId) {
      throw new BadRequestException('Conversion ID is required');
    }

    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    const supabase = this.createServiceSupabaseClient();

    const conversion = await this.findConversionForUser({
      supabase,
      conversionId,
      userId,
    });

    return this.formatConversion(conversion);
  }

  async getConversionStatus({ conversionId, userId }) {
    if (!conversionId) {
      throw new BadRequestException('Conversion ID is required');
    }

    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    const supabase = this.createServiceSupabaseClient();

    const conversion = await this.findConversionForUser({
      supabase,
      conversionId,
      userId,
    });

    const { data: logs, error: logsError } = await supabase
      .from(CONVERSION_LOGS_TABLE)
      .select('step, message, created_at')
      .eq('conversion_id', conversionId)
      .order('created_at', { ascending: true });

    if (logsError) {
      throw logsError;
    }

    return {
      conversion: this.formatConversion(conversion),
      logs: (logs || []).map((log) => ({
        step: log.step,
        message: log.message,
        timestamp: log.created_at,
      })),
    };
  }

  async findConversionForUser({ supabase, conversionId, userId }) {
    const { data: conversion, error } = await supabase
      .from(CONVERSIONS_TABLE)
      .select(
        [
          'id',
          'project_id',
          'project_name',
          'user_id',
          'status',
          'input_file_url',
          'output_file_url',
          'created_at',
          'completed_at',
        ].join(', '),
      )
      .eq('id', conversionId)
      .single();

    if (error || !conversion) {
      throw new NotFoundException('Conversion not found');
    }

    if (conversion.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this conversion');
    }

    return conversion;
  }

  formatConversion(conversion) {
    return {
      id: conversion.id,
      projectId: conversion.project_id,
      projectName: conversion.project_name,
      status: conversion.status,
      inputFileUrl: conversion.input_file_url,
      outputFileUrl: conversion.output_file_url,
      startedAt: conversion.created_at,
      completedAt: conversion.completed_at,
    };
  }

  async getOutputDownloadUrl({ conversionId, userId }) {
    if (!conversionId) {
      throw new BadRequestException('Conversion ID is required');
    }

    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    const supabase = this.createServiceSupabaseClient();

    const { data: conversion, error } = await supabase
      .from(CONVERSIONS_TABLE)
      .select('id, user_id, status, output_file_path')
      .eq('id', conversionId)
      .single();

    if (error || !conversion) {
      throw new NotFoundException('Conversion not found');
    }

    if (conversion.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this conversion output');
    }

    if (conversion.status !== 'COMPLETED' || !conversion.output_file_path) {
      throw new NotFoundException('Conversion output is not available yet');
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(OUTPUTS_BUCKET)
      .createSignedUrl(conversion.output_file_path, 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError || new Error('Failed to create signed output URL');
    }

    return {
      url: signedUrlData.signedUrl,
      expiresIn: 3600,
    };
  }

  createServiceSupabaseClient() {
    const supabaseUrl =
      this.configService.get('supabaseUrl') || process.env.SUPABASE_URL;

    const supabaseSecretKey =
      this.configService.get('supabaseSecretkey') ||
      process.env.SUPABASE_SECRET_KEY;

    return createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async queueProjectConversion({ projectId, projectName, userId, file }) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }
    if (!projectName) {
      throw new BadRequestException('Project name is required');
    }

    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    if (!file) {
      throw new BadRequestException('Only .zip files are accepted');
    }

    // Conversion limit only — project limit is in ProjectsService.createProject()
    await this.subscriptionsService.checkConversionLimit(userId);

    const timestamp = Date.now();
    const storagePath = `${userId}/${projectId}/${timestamp}.zip`;

    const supabase = this.createServiceSupabaseClient();

    this.logger.log(`Uploading ZIP to storage bucket "${UPLOADS_BUCKET}"`);

    const { error: uploadError } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || 'application/zip',
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(`Storage upload failed: ${uploadError.message}`);
      throw uploadError;
    }

    this.logger.log('Storage upload succeeded');

    const { data: publicUrlData } = supabase.storage
      .from(UPLOADS_BUCKET)
      .getPublicUrl(storagePath);

    const inputFileUrl = publicUrlData?.publicUrl;

    this.logger.log('Creating conversion row');

    const { data: conversion, error: insertError } = await supabase
      .from(CONVERSIONS_TABLE)
      .insert({
        project_id: projectId,
        project_name: projectName,
        user_id: userId,
        status: 'QUEUED',
        input_file_url: inputFileUrl,
      })
      .select()
      .single();

    if (insertError) {
      this.logger.error(`Conversion row insert failed: ${insertError.message}`);
      throw insertError;
    }

    this.logger.log(`Conversion row created: ${conversion?.id}`);

    if (!conversion?.id) {
      throw new Error('Failed to create conversion row');
    }

    const conversionId = conversion.id;

    await this.conversionQueue.add('convert-wordpress-theme', {
      conversionId,
      projectId,
      projectName,
      userId,
      inputFileUrl,
      inputFilePath: storagePath,
    });

    return {
      conversionId,
      status: 'QUEUED',
      message: 'Conversion job queued',
    };
  }

  /**
   * Fire-and-forget entry point. Intentionally not awaited by the caller
   * (see ConversionsController) so the HTTP response returns immediately,
   * regardless of how long the retry loop takes.
   *
   * Job payload shape:
   *   {
   *     ownerId: string (uuid, required),
   *     projectName: string,
   *     conversionId: string,
   *     projectId?: string,
   *     shouldFail?: boolean (test-only, forces every attempt to fail)
   *   }
   */
  runConversion(jobData) {
    setImmediate(async () => {
      const jobId = jobData.conversionId || `job-${Date.now()}`;
      let lastError;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const result = await this.attemptConversion(jobData);
          this.logger.log(`Job ${jobId} succeeded on attempt ${attempt}/${MAX_ATTEMPTS}`);
          await this.handleCompleted(jobData, result);
          return;
        } catch (error) {
          lastError = error;
          this.logger.log(
            `Job ${jobId} failed attempt ${attempt}/${MAX_ATTEMPTS}: ${error.message}`,
          );
          if (attempt < MAX_ATTEMPTS) {
            await wait(RETRY_DELAY_MS);
          }
        }
      }

      this.logger.warn(`Job ${jobId} exhausted all ${MAX_ATTEMPTS} attempts`);
      await this.handleFailed(jobData, lastError);
    });
  }

  /**
   * Stubbed conversion work. Replace with real file-conversion logic.
   */
  async attemptConversion(jobData) {
    if (jobData.shouldFail) {
      throw new Error('Simulated conversion failure: corrupt input file');
    }
    return { outputFileSize: '4.2 MB' };
  }

  async handleCompleted(jobData, result) {
    try {
      const owner = await this.getOwner(jobData.ownerId);
      if (!owner) {
        this.logger.warn(
          `Conversion for owner ${jobData.ownerId} completed but owner not found — skipping email`,
        );
        return;
      }

      const html = conversionCompleteEmail({
        projectName: jobData.projectName,
        convertedFiles: 1,
        duration: 'N/A',
        downloadUrl: this.buildDownloadUrl(jobData.conversionId),
      });

      await this.emailService.sendEmail(owner.email, 'Conversion Complete', html);
      this.logger.log(`Completion email sent to ${owner.email}`);
    } catch (error) {
      // Email failures must never affect job outcome — this runs after
      // the job has already succeeded.
      this.logger.error(`Failed to send completion email: ${error.message}`);
    }
  }

  async handleFailed(jobData, error) {
    try {
      const owner = await this.getOwner(jobData.ownerId);
      if (!owner) {
        this.logger.warn(
          `Conversion for owner ${jobData.ownerId} failed but owner not found — skipping email`,
        );
        return;
      }

      const html = conversionFailedEmail({
        projectName: jobData.projectName,
        error: error ? error.message : 'Unknown error',
        retryUrl: this.buildRetryUrl(jobData.projectId),
      });

      await this.emailService.sendEmail(owner.email, 'Conversion Failed', html);
      this.logger.log(`Failure email sent to ${owner.email}`);
    } catch (emailError) {
      this.logger.error(`Failed to send failure email: ${emailError.message}`);
    }
  }

  async getOwner(ownerId) {
    if (!ownerId) return null;
    return this.supabaseDbService.findOne('users', { filters: { id: ownerId } });
  }

  buildDownloadUrl(conversionId) {
    const apiBaseUrl =
      this.configService.get('apiBaseUrl') ||
      `http://localhost:${this.configService.get('port') || 3000}`;
    return `${apiBaseUrl}/api/conversions/${conversionId}/output`;
  }

  buildRetryUrl(projectId) {
    const frontendUrl = this.configService.get('frontendUrl') || 'http://localhost:3000';
    return `${frontendUrl}/projects/${projectId || ''}`;
  }
}