import {
    Injectable,
    AppConfig,
    AppConfigProperties,
    AppConfigService as CoreAppConfigService,
    FileSystem,
    PROJECT_TYPE_PRESET,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE
} from "@wocker/core";
import * as Path from "path";

import {WOCKER_VERSION, DATA_DIR, PLUGINS_DIR, PRESETS_DIR} from "../env";


type TypeMap = {
    [type: string]: string;
};

@Injectable("APP_CONFIG")
export class AppConfigService extends CoreAppConfigService {
    protected _pwd: string;
    protected _fs?: FileSystem;

    protected readonly mapTypes: TypeMap = {
        [PROJECT_TYPE_IMAGE]: "Image",
        [PROJECT_TYPE_DOCKERFILE]: "Dockerfile",
        [PROJECT_TYPE_PRESET]: "Preset"
    };

    public constructor() {
        super();

        this._pwd = (process.cwd() || process.env.PWD) as string;
    }

    public get version(): string {
        return WOCKER_VERSION;
    }

    public get fs(): FileSystem {
        if(!this._fs) {
            this._fs = new FileSystem(DATA_DIR);
        }

        return this._fs;
    }

    public pwd(...parts: string[]): string {
        return Path.join(this._pwd, ...parts);
    }

    public setPWD(pwd: string): void {
        this._pwd = pwd;
    }

    public dataPath(...parts: string[]): string {
        return Path.join(DATA_DIR, ...parts);
    }

    public pluginsPath(...parts: string[]): string {
        return Path.join(PLUGINS_DIR, ...parts);
    }

    public presetPath(...parts: string[]): string {
        return Path.join(PRESETS_DIR, ...parts);
    }

    public getProjectTypes(): TypeMap {
        return this.mapTypes;
    }

    // noinspection JSUnusedGlobalSymbols
    protected loadConfig(): AppConfig {
        const fs = this.fs;

        let data: AppConfigProperties = {};

        if(fs.exists("wocker.config.js")) {
            try {
                const {config} = require(fs.path("wocker.config.js"));

                data = config;
            }
            catch(err) {
                // TODO: Log somehow

                if(fs.exists("wocker.config.json")) {
                    let json = fs.readJSON("wocker.config.json");

                    if(typeof json === "string") {
                        json = JSON.parse(json);
                    }

                    data = json;
                }
            }
        }
        else if(fs.exists("wocker.config.json")) {
            data = fs.readJSON("wocker.config.json");
        }
        else if(fs.exists("wocker.json")) {
            let json = fs.readJSON("wocker.json");

            if(typeof json === "string") {
                json = JSON.parse(json);
            }

            data = json;
        }
        else if(fs.exists("data.json")) {
            data = fs.readJSON("data.json");
        }
        else if(!fs.exists()) {
            fs.mkdir("", {
                recursive: true
            });
        }

        return new class extends AppConfig {
            public constructor(data: AppConfigProperties) {
                super(data);
            }

            public async save(): Promise<void> {
                if(!fs.exists()) {
                    fs.mkdir("");
                }

                const json = JSON.stringify(this.toJson(), null, 4);

                await fs.writeFile("wocker.config.js", `// Wocker config\nexports.config = ${json};`);
                // Backup file
                await fs.writeFile("wocker.config.json", json);

                if(fs.exists("data.json")) {
                    await fs.rm("data.json");
                }

                if(fs.exists("wocker.json")) {
                    await fs.rm("wocker.json");
                }
            }
        }(data);
    }
}
