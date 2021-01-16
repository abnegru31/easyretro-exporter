import {promisify} from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

export default async function streamer (data: string[], writer: stream.Writable): Promise<void> {
    await pipeline(
        new class extends stream.Readable {
            private generator: Generator;
            constructor() {
                super({objectMode: true});
            }
            private *recordGenerator () {
                yield* data;
            }
            _read() {
                if (!this.generator) {
                    this.generator = this.recordGenerator();
                }
                let result;
                let push: boolean;

                // Control stream back pressure and respect the high water mark :)
                do {
                    result = this.generator.next();
                    push = this.push(result.value ?? '');
                } while (push && !result.done);

                if (result.done) {
                    this.push(null);
                }
            }
        },
        writer,
    );
}
