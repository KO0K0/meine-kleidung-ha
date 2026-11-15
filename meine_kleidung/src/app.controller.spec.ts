import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { I18nContext } from 'nestjs-i18n';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, ConfigService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('index', () => {
    it('opens the inventory rather than the upstream landing page', () => {
      const reply = { redirect: jest.fn() };
      appController.index(reply as any);
      expect(reply.redirect).toHaveBeenCalledWith('/inventory', 302);
    });
  });
});
