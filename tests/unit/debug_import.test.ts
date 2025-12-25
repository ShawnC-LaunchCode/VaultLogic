
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerAiRoutes } from '../../server/routes/ai.routes';

describe('Debug Test', () => {
    it('should find module', () => {
        expect(registerAiRoutes).toBeDefined();
    });
});
