import {Factory, CommandNotFoundError} from "@wocker/core";
import chalk from "chalk";

import {AppModule} from "./AppModule";
import {AppConfigService, LogService} from "./services";


export const app = {
    async run(args: string[]): Promise<void> {
        const app = await Factory.create(AppModule);
        const config = app.get(AppConfigService);
        const logger = app.get(LogService);

        try {
            const res = await app.run(args);

            if(res) {
                process.stdout.write(res);
                process.stdout.write("\n");
            }
        }
        catch(err) {
            console.error(chalk.red(err.message));

            if(err instanceof CommandNotFoundError) {
                return;
            }

            const {debug} = config.getConfig();

            if(debug) {
                logger.error(err.stack || err.toString());
            }
        }
    }
};
