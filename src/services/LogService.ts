import {
    DI,
    AppConfigService
} from "@wocker/core";
import dateFormat from "date-fns/format";

import {FS} from "../makes";


class LogService {
    protected appConfigService: AppConfigService;

    public constructor(di: DI) {
        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
    }

    public log(...data: any[]): void {
        this._log("log", ...data);
    }

    public info(...data: any[]): void {
        this._log("info", ...data);
    }

    public warning(...data: any[]): void {
        this._log("warning", ...data);
    }

    public error(...data: any[]): void {
        this._log("error", ...data);
    }

    protected _log(type: string, ...data: any[]): void {
        const time = dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
        const logPath = this.appConfigService.dataPath("ws.log");

        const logData = data.map((item) => {
            return typeof item !== "string" ? JSON.stringify(item) : item;
        }).join(" ");

        if(!FS.existsSync(logPath)) {
            FS.writeFileSync(logPath, "");
        }

        FS.appendFileSync(logPath, `[${time}] ${type}: ${logData}\n`);
    }
}


export {LogService};
