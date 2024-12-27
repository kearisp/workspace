import {
    Command,
    Description,
    Param,
    Completion,
    Controller
} from "@wocker/core";

import {AppConfigService, LogService} from "../services";


@Controller()
export class DebugController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly logService: LogService
    ) {}

    @Command("debug")
    public async debug(): Promise<string> {
        return this.appConfigService.config.debug ? "on" : "off";
    }

    @Command("debug:<status>")
    @Command("debug <status>")
    public async setDebug(
        @Param("status")
        status: string
    ): Promise<void> {
        this.appConfigService.config.debug = status === "on";

        await this.appConfigService.config.save();
    }

    @Description("Set the log level (options: debug, log, info, warn, error)")
    @Command("loglevel <level>")
    public async setLog(
        @Param("level")
        level: string
    ): Promise<void> {
        const validLevels = this.getLevels();

        if(!validLevels.includes(level)) {
            throw new Error(`Invalid log level: ${level}. Valid options are ${validLevels.join(', ')}`);
        }

        const config = this.appConfigService.getConfig();

        config.logLevel = level as any;

        await config.save();
    }

    @Command("log:<level> [...args]")
    public async testLog(
        @Param("level")
        level: string,
        @Param("args")
        args: string[]
    ): Promise<void> {
        (this.logService as any)._log(level, ...args);
    }

    @Completion("status")
    public async debugCompletion(): Promise<string[]> {
        return ["on", "off"];
    }

    @Completion("level")
    public getLevels(): string[] {
        return ["debug", "info", "warn", "error"];
    }
}