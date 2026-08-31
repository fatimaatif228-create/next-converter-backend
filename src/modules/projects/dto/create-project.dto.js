const { IsString, IsNotEmpty, IsOptional } = require('class-validator');
const { ApiProperty } = require('@nestjs/swagger');

class CreateProjectDto {
  @ApiProperty({
    type: String,
    example: 'My WordPress Site',
    description: 'Name of the project',
  })
  @IsString()
  @IsNotEmpty()
  name = '';

  @ApiProperty({
    type: String,
    example: 'uuid-org-id-here',
    required: false,
    description: 'Optional Organization ID',
  })
  @IsString()
  @IsOptional()
  orgId;
}

module.exports = { CreateProjectDto };