import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const validPassword = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.email);
  }

  private issueTokens(userId: string, email: string) {
    return {
      accessToken: this.jwtService.sign({
        sub: userId,
        email,
      }),
      tokenType: 'Bearer',
    };
  }
}
