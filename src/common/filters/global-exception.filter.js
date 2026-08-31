import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter {
  logger = new Logger('ExceptionFilter');

  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const responseMessage =
      typeof errorResponse === 'object' && errorResponse !== null
        ? errorResponse.message
        : errorResponse;

    const isMulterFileSizeError =
      exception?.code === 'LIMIT_FILE_SIZE' ||
      (
        exception instanceof HttpException &&
        exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE &&
        responseMessage === 'File too large'
      );

    const status = isMulterFileSizeError
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isMulterFileSizeError
      ? 'File larger than 50MB'
      : typeof errorResponse === 'object' && errorResponse !== null
        ? errorResponse.message
        : errorResponse || exception.message || 'Internal Server Error';

    // This is the piece that was missing entirely: without logging here,
    // every 500 is a black box, since the client only ever sees the
    // sanitized message above, never the real error or stack trace.
    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${
        exception instanceof Error ? exception.message : JSON.stringify(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}