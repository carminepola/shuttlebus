
export default class sessionModel {
    id: string;
    update: boolean;
    createdAt: number;
    updatedAt: number;
    refreshToken: string
    constructor(

    ) {
        this.id = "";
        this.update = false;
        this.createdAt = new Date().getTime();
        this.updatedAt = new Date().getTime()
        this.refreshToken = "";

    }
}
