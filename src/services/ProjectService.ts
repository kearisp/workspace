import {
    Injectable,
    Project,
    ProjectProperties,
    PROJECT_TYPE_DOCKERFILE
} from "@wocker/core"

import {AppConfigService} from "./AppConfigService";
import {AppEventsService} from "./AppEventsService";
import {DockerService} from "./DockerService";


type SearchParams = Partial<{
    name: string;
    path: string;
}>;

@Injectable("PROJECT_SERVICE")
class ProjectService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly dockerService: DockerService
    ) {}

    public fromObject(data: Partial<ProjectProperties>): Project {
        const _this = this;

        return new class extends Project {
            public constructor(data: ProjectProperties) {
                super(data);
            }

            public async save(): Promise<void> {
                await _this.save(this);
            }
        }(data as ProjectProperties);
    }

    public get(name?: string): Project {
        const project = name
            ? this.searchOne({name})
            : this.searchOne({
                path: this.appConfigService.pwd()
            });

        if(!project) {
            throw new Error("Project not found");
        }

        if(name) {
            this.appConfigService.setPWD(project.path);
        }

        return project;
    }

    public getById(id: string): Project {
        const config = this.appConfigService.getConfig();
        const projectData = config.getProject(id);
        const data = this.appConfigService.fs.readJSON("projects", id, "config.json");

        return this.fromObject({
            ...data,
            path: projectData.path || projectData.src
        });
    }

    public cdProject(name: string): void {
        const project = this.searchOne({
            name
        });

        if(!project) {
            throw new Error("Project not found");
        }

        this.appConfigService.setPWD(project.path);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean): Promise<void> {
        let container = await this.dockerService.getContainer(project.containerName);

        if(container && (restart || rebuild)) {
            container = null;

            await this.appEventsService.emit("project:stop", project);

            await this.dockerService.removeContainer(project.containerName);
        }

        if(!container) {
            if(project.type === PROJECT_TYPE_DOCKERFILE) {
                project.imageName = `project-${project.name}:develop`;

                if(rebuild) {
                    await this.dockerService.imageRm(project.imageName);
                }

                const images = await this.dockerService.imageLs({
                    tag: project.imageName
                });

                if(images.length === 0) {
                    await this.dockerService.buildImage({
                        tag: project.imageName,
                        buildArgs: project.buildArgs,
                        context: this.appConfigService.pwd(),
                        src: project.dockerfile
                    });
                }
            }

            if(rebuild) {
                await this.appEventsService.emit("project:rebuild", project);
            }

            await this.appEventsService.emit("project:beforeStart", project);

            const config = this.appConfigService.getConfig();

            container = await this.dockerService.createContainer({
                name: project.containerName,
                image: project.imageName,
                env: {
                    ...config.env || {},
                    ...project.env || {}
                },
                ports: project.ports || [],
                volumes: (project.volumes || []).map((volume: string): string => {
                    const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;
                    const [, source, destination, options] = regVolume.exec(volume);

                    if(source.startsWith("/")) {
                        return volume;
                    }

                    return `${this.appConfigService.pwd(source)}:${destination}` + (options ? `:${options}` : "");
                }),
                extraHosts: Object.keys(project.extraHosts || {}).map((host: string) => {
                    return `${project.extraHosts[host]}:${host}`;
                })
            });
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "created" || Status === "exited") {
            await container.start();
        }

        await this.appEventsService.emit("project:start", project);
    }

    public async stop(project: Project): Promise<void> {
        const container = await this.dockerService.getContainer(project.containerName);

        if(!container) {
            return;
        }

        await this.appEventsService.emit("project:stop", project);

        await this.dockerService.removeContainer(project.containerName);
    }

    public async save(project: Project): Promise<void> {
        if(!project.name) {
            throw new Error("Project should has a name");
        }

        if(!project.path) {
            throw new Error("Project should has a path");
        }

        if(!project.id) {
            project.id = project.name;
        }

        const config = this.appConfigService.config;

        if(!this.appConfigService.fs.exists(`projects/${project.id}`)) {
            this.appConfigService.fs.mkdir(`projects/${project.id}`, {
                recursive: true
            });
        }

        const {
            path,
            ...rest
        } = project.toJSON();

        config.addProject(project.id, project.name, path);

        this.appConfigService.fs.writeJSON(`projects/${project.id}/config.json`, rest);
        await config.save();
    }

    public search(params: Partial<SearchParams> = {}): Project[] {
        const {name, path} = params;

        const config = this.appConfigService.getConfig();

        const projects: Project[] = [];

        for(const projectConfig of config.projects || []) {
            if(name && projectConfig.name !== name) {
                continue;
            }

            if(path && (projectConfig.path || projectConfig.src) !== path) {
                continue;
            }

            const project = this.getById(projectConfig.id);

            if(name && project.name !== name) {
                continue;
            }

            projects.push(project);
        }

        return projects;
    }

    public searchOne(params: Partial<SearchParams> = {}): Project | null {
        const [project] = this.search(params);

        return project || null;
    }
}


export {ProjectService};
