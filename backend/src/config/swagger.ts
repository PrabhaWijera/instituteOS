import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'NexClass API',
      version: '1.0.0',
      description: 'NexClass Institute Management Platform API Documentation',
      contact: {
        name: 'NexClass Team',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
      { url: '/api', description: 'API (backward compat)' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', minLength: 6, example: 'password123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: { type: 'object' },
                accessToken: { type: 'string' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
            isActive: { type: 'boolean' },
            profileImage: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Institute: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AttendanceSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            teacherId: { type: 'string', format: 'uuid' },
            otpCode: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'ENDED'] },
            startedAt: { type: 'string', format: 'date-time' },
            endedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        PaymentDue: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            studentId: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['PENDING', 'PAID', 'OVERDUE'] },
            dueDate: { type: 'string', format: 'date' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.swagger.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
