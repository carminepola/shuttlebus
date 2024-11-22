
export default class sessionModel {
    id: string;
    update: boolean;
    createdAt: number;
    updatedAt: number;
    constructor(

    ) {
        this.id = "";
        this.update = false;
        this.createdAt = new Date().getTime();
        this.updatedAt = new Date().getTime()

    }
}
