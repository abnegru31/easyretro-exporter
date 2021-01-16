import bunyan from 'bunyan';

class Logger {
    public logger: bunyan;

    public init(name: string): void {
        this.logger = bunyan.createLogger({name});
    }
}

const log = new Logger();

export default log;
