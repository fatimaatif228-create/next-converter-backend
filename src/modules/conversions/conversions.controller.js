const {
  Controller,
  Post,
  Get,
  Dependencies,
  Scope,
  BadRequestException,
  NotFoundException,
  UseGuards,
  UseInterceptors,
} = require('@nestjs/common');
const { REQUEST } = require('@nestjs/core');
const {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
} = require('@nestjs/swagger');
const { FileInterceptor } = require('@nestjs/platform-express');
const { memoryStorage } = require('multer');

const { ConversionsService } = require('./conversions.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');
const { MinRoleGuard } = require('../../common/guards/min-role.guard');
const { MinRole } = require('../../common/decorators/min-role.decorator');

const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024;

function zipFileFilter(req, file, callback) {
  const originalName = file.originalname || '';
  const isZip = originalName.toLowerCase().endsWith('.zip');

  if (!isZip) {
    return callback(
      new BadRequestException('Only .zip files are accepted'),
      false,
    );
  }

  return callback(null, true);
}

/**
 * Request-scoped so REQUEST resolves to the current HTTP request, letting
 * us read the body manually instead of using @Body() (a parameter
 * decorator — see EmailController/AuthController for why this project
 * avoids those).
 *
 * This controller owns the project-scoped conversion upload endpoint:
 * POST /api/projects/:id/convert
 */
@ApiTags('Conversions')
@Controller({ path: 'projects', scope: Scope.REQUEST })
@Dependencies(ConversionsService, REQUEST)
export class ProjectConversionsController {
  constructor(conversionsService, request) {
    this.conversionsService = conversionsService;
    this.request = request;
  }

  @Post(':id/convert')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
@MinRole('EDITOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload a WordPress theme ZIP and queue a conversion job',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    required: true,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'projectName'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        projectName: {
          type: 'string',
          example: 'My WordPress Site',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Conversion job queued',
  })
  @ApiResponse({
    status: 400,
    description: 'Only .zip files are accepted',
  })
  @ApiResponse({
  status: 403,
  description: 'Viewers cannot upload/convert — EDITOR or OWNER role required',
})
  @ApiResponse({
    status: 413,
    description: 'File larger than 50MB',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_ZIP_SIZE_BYTES,
      },
      fileFilter: zipFileFilter,
    }),
  )
  async queueProjectConversion() {
    const projectId = this.request.params?.id;
    const userId = this.request.user?.id;
    const file = this.request.file;
    const projectName = this.request.body?.projectName;

    if (!file) {
      throw new BadRequestException('Only .zip files are accepted');
    }

    return this.conversionsService.queueProjectConversion({
      projectId,
      projectName,
      userId,
      file,
    });
  }
}

/**
 * Request-scoped so REQUEST resolves to the current HTTP request, letting
 * us read the body manually instead of using @Body() (a parameter
 * decorator — see EmailController/AuthController for why this project
 * avoids those).
 */
@ApiTags('Conversions')
@Controller({ path: 'conversions', scope: Scope.REQUEST })
@Dependencies(ConversionsService, REQUEST)
export class ConversionsController {
  constructor(conversionsService, request) {
    this.conversionsService = conversionsService;
    this.request = request;
  }

  @Post('test-job')
  @ApiOperation({
    summary: 'Trigger a test conversion job (dev/testing only)',
  })
  @ApiBody({
    schema: {
      example: {
        ownerId: 'a1b2c3d4-...',
        projectName: 'My Project',
        conversionId: 'conv-123',
        shouldFail: false,
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Job started' })
  async triggerTestJob() {
    const body = this.request.body || {};
    const { ownerId, projectName, conversionId, shouldFail } = body;

    if (!ownerId || !projectName) {
      throw new BadRequestException('"ownerId" and "projectName" are required');
    }

    // Fire-and-forget: runConversion() is not awaited, so the response
    // returns immediately regardless of retry timing.
    this.conversionsService.runConversion({
      ownerId,
      projectName,
      conversionId: conversionId || `conv-${Date.now()}`,
      projectId: body.projectId,
      shouldFail: Boolean(shouldFail),
    });

    return { status: 'started' };
  }

  @Get(':id/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
      summary: 'Get conversion status and logs',
      description:
        'Returns the conversion record and all conversion logs. Frontend should subscribe to Supabase Realtime on conversion_logs filtered by conversionId for live updates without polling.',
    })
    @ApiParam({
      name: 'id',
      description: 'Conversion ID',
      required: true,
    })
    @ApiResponse({
      status: 200,
      description: 'Conversion status and logs returned',
      schema: {
        example: {
          conversion: {
            id: 'conv-uuid-1234',
            projectId: 'proj-uuid-5678',
            projectName: 'Twenty Twenty-Four Test',
            status: 'PROCESSING',
            inputFileUrl: 'https://storage.../input.zip',
            outputFileUrl: null,
            startedAt: '2026-06-17T10:00:00.000Z',
            completedAt: null,
          },
          logs: [
            {
              step: 'PARSED',
              message: 'WordPress theme parsed successfully',
              timestamp: '2026-06-17T10:00:01.000Z',
            },
          ],
        },
      },
    })
    @ApiResponse({
      status: 403,
      description: 'User does not have access to this conversion',
    })
    @ApiResponse({
      status: 404,
      description: 'Conversion not found',
    })
    async getStatus() {
      const conversionId = this.request.params?.id;
      const userId = this.request.user?.id;

      return this.conversionsService.getConversionStatus({
        conversionId,
        userId,
      });
    }

  @Get(':id/output')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a signed download URL for a completed conversion output ZIP',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversion ID',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Signed output download URL created',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have access to this conversion',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversion output is not available',
  })
  async getOutput() {
    const conversionId = this.request.params?.id;
    const userId = this.request.user?.id;

    return this.conversionsService.getOutputDownloadUrl({
      conversionId,
      userId,
    });
  }

  @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
      summary: 'Get conversion record',
      description: 'Returns the conversion record only, without conversion logs.',
    })
    @ApiParam({
      name: 'id',
      description: 'Conversion ID',
      required: true,
    })
    @ApiResponse({
      status: 200,
      description: 'Conversion record returned',
      schema: {
        example: {
          id: 'conv-uuid-1234',
          projectId: 'proj-uuid-5678',
          projectName: 'Twenty Twenty-Four Test',
          status: 'COMPLETED',
          inputFileUrl: 'https://storage.../input.zip',
          outputFileUrl: 'https://storage.../output.zip',
          startedAt: '2026-06-17T10:00:00.000Z',
          completedAt: '2026-06-17T10:01:00.000Z',
        },
      },
    })
    @ApiResponse({
      status: 403,
      description: 'User does not have access to this conversion',
    })
    @ApiResponse({
      status: 404,
      description: 'Conversion not found',
    })
    async getConversion() {
      const conversionId = this.request.params?.id;
      const userId = this.request.user?.id;

      return this.conversionsService.getConversionRecord({
        conversionId,
        userId,
      });
    }
    
}