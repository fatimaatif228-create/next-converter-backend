const {
  Controller,
  Post,
  Get,
  Body,
  Bind,
  UseGuards,
  Dependencies,
  BadRequestException,
} = require('@nestjs/common');
const {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} = require('@nestjs/swagger');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');
const { CurrentUser } = require('../../common/decorators/current-user.decorator');
const { ProjectsService } = require('./projects.service');
const { CreateProjectDto } = require('./dto/create-project.dto');

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
@Dependencies(ProjectsService)
export class ProjectsController {
  constructor(projectsService) {
    this.projectsService = projectsService;
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for authenticated user' })
  @ApiResponse({ status: 200, description: 'List of projects' })
  @Bind(CurrentUser())
  async getProjects(user) {
    return this.projectsService.getUserProjects(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new project (Enforces plan project limits)',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Project created' })
  @ApiResponse({
    status: 403,
    description: 'Project limit reached for current plan',
  })
  @Bind(CurrentUser(), Body())
  async createProject(user, body) {
    const dto = plainToInstance(CreateProjectDto, body);
    const errors = await validate(dto);

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.projectsService.createProject(user.id, dto);
  }
}
