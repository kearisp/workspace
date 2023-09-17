import {
    DI,
    AppConfigService as CoreAppConfigService,
    AppEventsService as CoreAppEventsService,
    DockerService,
    ProjectService as CoreProjectService,
    ProjectServiceSearchParams as SearchParams,
    Project
} from "@wocker/core";
import * as Path from "path";

import {Docker, FS} from "src/makes";


class ProjectService extends CoreProjectService {
    protected appConfigService: CoreAppConfigService;
    protected appEventsService: CoreAppEventsService;
    protected dockerService: DockerService;

    public constructor(di: DI) {
        super();

        this.appConfigService = di.resolveService<CoreAppConfigService>(CoreAppConfigService);
        this.appEventsService = di.resolveService<CoreAppEventsService>(CoreAppEventsService);
        this.dockerService = di.resolveService<DockerService>(DockerService);
    }

    public async cdProject(name: string) {
        const project = await Project.searchOne({
            name
        });

        if(!project) {
            throw new Error("Project not found");
        }

        this.appConfigService.setPWD(project.path);
    }

    public async get() {
        const project = await Project.searchOne({
            path: this.appConfigService.getPWD()
        });

        if(!project) {
            throw new Error("Project not found");
        }

        return project;
    }

    public async start() {
        const project = await this.get();

        if(project.type === "dockerfile") {
            project.imageName = `project-${project.name}:develop`;

            const images = await Docker.imageLs({
                tag: project.imageName
            });

            if(images.length === 0) {
                await Docker.imageBuild2({
                    tag: project.imageName,
                    context: this.appConfigService.getPWD(),
                    src: project.dockerfile
                });
            }
        }

        await this.appEventsService.emit("project:beforeStart", project);

        const containerName = `${project.name}.workspace`;

        let container = await this.dockerService.getContainer(containerName);

        if(!container) {
            container = await Docker.createContainer({
                name: containerName,
                image: project.imageName,
                env: {
                    ...await this.appConfigService.getAllEnvVariables(),
                    ...project.env || {}
                },
                volumes: (project.volumes || []).map((volume: string) => {
                    const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;
                    const [, source, destination, options] = regVolume.exec(volume);

                    return `${Path.join(this.appConfigService.getPWD(), source)}:${destination}` + (options ? `:${options}` : "");
                }),
                ports: project.ports || []
            });
        }
        else {
            process.stdout.write("Container already exists\n");
        }

        if(container) {
            const {
                State: {
                    Status
                }
            } = await container.inspect();

            if(Status === "created" || Status === "exited") {
                await container.start();

                await this.appEventsService.emit("project:start", project);
            }
        }
    }

    public async stop() {
        const project = await this.get();

        const container = await Docker.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.appEventsService.emit("project:stop", project);

            await Docker.removeContainer(`${project.name}.workspace`);
        }
    }

    public async save(project: Project) {
        if(!project.name) {
            throw new Error("Project should has a name");
        }

        if(!project.path) {
            throw new Error("Project should has a path");
        }

        if(!project.id) {
            project.id = project.name;
        }

        const projectDirPath = this.appConfigService.dataPath("projects", project.id);
        const configPath = this.appConfigService.dataPath("projects", project.id, "config.json");

        if(!FS.existsSync(projectDirPath)) {
            await FS.mkdir(projectDirPath, {
                recursive: true
            });
        }

        await this.appConfigService.setProjectConfig(project.id, project.path);

        await FS.writeJSON(configPath, project);
    }

    public async search(params: Partial<SearchParams> = {}): Promise<Project[]> {
        const {id, name, path} = params;

        const {
            projects: configs
        } = await this.appConfigService.getAppConfig();

        const projects: Project[] = [];

        for(const config of configs) {
            if(id && config.id !== id) {
                continue;
            }

            if(path && config.src !== path) {
                continue;
            }

            const projectData = await FS.readJSON(this.appConfigService.dataPath("projects", config.id, "config.json"));

            if(name && projectData.name !== name) {
                continue;
            }

            const project = Project.fromObject({
                id: config.id,
                ...projectData
            });

            projects.push(project);
        }

        return projects;
    }
}


export {ProjectService};
