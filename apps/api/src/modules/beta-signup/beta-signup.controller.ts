// Beta Signup Controller - Public endpoint for landing page registration

import { Controller, Get, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { BetaSignupService } from './beta-signup.service';

interface BetaSignupDto {
  brand: string;
  category: string;
  name: string;
  position: string;
  age?: number;
  phone: string;
  store_count?: string;
  annual_revenue?: string;
  city: string;
  help_text?: string;
}

const PHONE_REGEX = /^1[3-9]\d{9}$/;

@Controller('beta-signup')
export class BetaSignupController {
  private readonly logger = new Logger(BetaSignupController.name);

  constructor(private readonly betaSignupService: BetaSignupService) {}

  @Get()
  async findAll() {
    const data = await this.betaSignupService.findAll();
    return { data, message: '查询成功' };
  }

  @Public()
  @Post()
  async create(@Body() body: BetaSignupDto) {
    // Validate required fields
    const required: (keyof BetaSignupDto)[] = ['brand', 'category', 'name', 'position', 'phone', 'city'];
    for (const field of required) {
      if (!body[field] || (typeof body[field] === 'string' && !(body[field] as string).trim())) {
        throw new BadRequestException(`${field} 为必填项`);
      }
    }

    // Validate phone format
    if (!PHONE_REGEX.test(body.phone)) {
      throw new BadRequestException('请输入有效的手机号');
    }

    // Validate age if provided
    if (body.age !== undefined && body.age !== null) {
      const age = Number(body.age);
      if (isNaN(age) || age < 18 || age > 100) {
        throw new BadRequestException('请输入有效的年龄');
      }
      body.age = age;
    }

    await this.betaSignupService.create({
      brand: body.brand.trim(),
      category: body.category.trim(),
      name: body.name.trim(),
      position: body.position.trim(),
      age: body.age,
      phone: body.phone.trim(),
      store_count: body.store_count?.trim(),
      annual_revenue: body.annual_revenue?.trim(),
      city: body.city.trim(),
      help_text: body.help_text?.trim(),
    });

    return { data: null, message: '报名成功' };
  }
}
