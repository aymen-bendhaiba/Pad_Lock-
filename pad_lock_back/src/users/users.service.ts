import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

type CreateUserInput = {
  email: string;
  fullName: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await this.usersRepository.existsBy({ email });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    return this.usersRepository.save(
      this.usersRepository.create({
        ...input,
        email,
      }),
    );
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email: email.toLowerCase() });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }
}
