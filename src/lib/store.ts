import {BoardInformation} from './models';

class Store {
    public boardInformation: BoardInformation;
    public save(boardInformation: BoardInformation) {
        this.boardInformation = boardInformation;
    }
}

const store = new Store();

export default store;
