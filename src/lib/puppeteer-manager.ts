import bunyan from 'bunyan';
import genericPool from 'generic-pool';
import puppeteer from 'puppeteer';
import logger from './log';

// Responsible for handling puppeteer resource use. Implements a pooling like method to available resources.
// As configured, it allows for 10 simultaneous uses of a chromium page, and will not release any resources until at least one frees up
class PuppeteerManager {
    public pagePool: genericPool.Pool<puppeteer.Page>;
    private browser: puppeteer.Browser;
    private log: bunyan;

    public async stop() {
        try {
            await this.pagePool.drain();
            await this.pagePool.clear();
            await this.browser.close();
        } catch (err) {
            this.log.error('Failed to shutdown puppeteer resource manager', err);
        }
    }

    public async init() {
        this.log = logger.logger.child({component: 'puppeteer-manager'});
        this.browser = await puppeteer.launch({
            args: ['--no-sandbox'],
            headless: true,
        });
        this.pagePool = genericPool.createPool<puppeteer.Page>(this.poolFactory(), {max: 10});

        this.pagePool.on('factoryDestroyError', (err) => {
            this.log.error('Failed to destroy pool resource', err);
        });

        this.log.info('Puppeteer resource manager started successfully');
    }

    private poolFactory() {
        return {
            create: async () => await this.browser.newPage(),
            destroy: async (resource: puppeteer.Page) => this.pagePool.isBorrowedResource(resource) ? await resource.close() : undefined,
        };
    }
}

// We want a singleton of this class due to chromium being very heavy in memory requirements
const puppeteerManager = new PuppeteerManager();

export default puppeteerManager;
