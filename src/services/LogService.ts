import {
    FileSystem,
    Injectable,
    LogService as CoreLogService
} from "@wocker/core";
import dateFormat from "date-fns/format";

import {Logger} from "../makes";
import {AppConfigService} from "./AppConfigService";


@Injectable("LOG_SERVICE")
export class LogService extends CoreLogService {
    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {
        super();

        Logger.install(this);
    }

    protected get fs(): FileSystem {
        return this.appConfigService.fs;
    }

    protected get logName(): string {
        return "ws.log";
    }

    public debug(...data: any[]): void {
        this._log("debug", ...data);
    }

    public log(...data: any[]): void {
        this._log("log", ...data);
    }

    public info(...data: any[]): void {
        this._log("info", ...data);
    }

    public warn(...data: any[]): void {
        this._log("warn", ...data);
    }

    public error(...data: any[]): void {
        this._log("error", ...data);
    }

    public clear(): void {
        this.fs.writeFile(this.logName, "");
    }

    protected _log(type: string, ...data: any[]): void {
        if(type === "debug" && !this.appConfigService.config.debug) {
            return;
        }

        const time = dateFormat(new Date(), "yyyy-MM-dd HH:mm:ss"),
            logData = data.map((item): string => {
            return typeof item !== "string" ? JSON.stringify(item) : item;
        }).join(" ");

        if(!this.fs.exists(this.logName)) {
            this.fs.writeFile(this.logName, "");
        }

        this.fs.appendFile(this.logName, `[${time}] ${type}: ${logData}\n`);
    }
}
