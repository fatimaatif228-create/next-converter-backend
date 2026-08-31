import { createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data, ctx) => {
  const request = ctx.switchToHttp().getRequest();

  if (data) {
    return request.user?.[data];
  }

  return request.user;
});
