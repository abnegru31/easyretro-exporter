export class Message {
    constructor(
        public messageId: string,
        public text: string,
        public votes: number,
    ) {
        //
    }
}

export class BoardColumn {
    constructor(
        public id: number,
        public value: string,
        public messageIds: string[],
    ) {
        //
    }
}

export class BoardInformation {
    constructor(
        public boardName: string,
        public columns?: BoardColumn[],
        public messages?: Message[],
    ) {
        this.columns = [];
        this.messages = [];
    }
}

export interface ArgV {
    u: string;
    url: string;
    f: string;
    format: string;
    d: string;
    destination: string;
}
