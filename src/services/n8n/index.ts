import { config } from '../../config/env.js';
import { IN8nService } from './interface.js';
import { MockN8nService } from './mock.js';
import { RealN8nService } from './real.js';

export function getN8nService(): IN8nService {
    if (config.APP_MODE === 'production') {
        return new RealN8nService();
    }
    return new MockN8nService();
}
