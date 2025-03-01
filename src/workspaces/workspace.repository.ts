import { Injectable } from "@nestjs/common";
import { constants, mkdir, readFile, readdir, stat, writeFile, access, rename } from "fs/promises";
import { join } from "path";
import { workspacesPath } from '../utils'

export type Item = {
  name: string;
  type: "folder" | "file";
  items: Item[];
};

@Injectable()
export class WorkspaceRepository {
  async findOne(workspaceName: string) {
    const workspaces = (await readdir(workspacesPath)).filter((item)=> item !== '.git');

    const data = [] as Item[];
    await Promise.all(
      workspaces.map(async (item) => {
        const stats = await stat(join(workspacesPath, item));

        if (stats.isDirectory()) {
          const workspace = {
            name: item,
            type: "folder",
            items: [],
          } satisfies Item;

          await this.readWorkspace(workspace, join(workspacesPath, item));

          data.push(workspace);
        }
        return null;
      }),
    );

    return data.find((item)=> item.name === workspaceName)
  }

  private async readWorkspace(data: Item, currentPath: string) {
    const childrenItems = (await readdir(currentPath)).sort();
    console.log(childrenItems)
    await Promise.all(
      childrenItems.map(async (item,index) => {
        const stats = await stat(join(currentPath, item));
        if (stats.isFile()) {
          const file = {
            name: item,
            type: "file",
            items: [],
          } satisfies Item;

          data.items[index]= file;
        }
        if (stats.isDirectory()) {
          const directory = {
            name: item,
            type: "folder",
            items: [],
          } satisfies Item;

          await this.readWorkspace(directory, join(currentPath, item));

          data.items[index]= directory;
        }
      }),
    );
  }

  async getContent(workspaceName: string, path: string) {
    try {
      const absolutePath = join(workspacesPath, workspaceName, path);
      return await readFile(absolutePath, "utf8");
    } catch (error) {
      console.log("Content Not Found", path);
      return "";
    }
  }

  async create(workSpace: string, relatedPath: string, type: "folder" | "file") {
    const paths = relatedPath.split("/");

    const cleanedPaths = paths[paths.length - 1].includes(".")
      ? paths.slice(0, paths.length - 1)
      : paths;

    const workspace = await this.findOne(workSpace);

    if (type === "file") this.addFile(workspace, 0, cleanedPaths);

    if (type === "folder") this.addFolder(workspace, 0, cleanedPaths);

    return workspace;
  }

  async addFile(data: Item, level, cleanedPaths: string[]) {
    const currentLevel = level;

    if (data.name === cleanedPaths[level]) {
      if (cleanedPaths.length - 1 === level) {
        const count = data.items.length;
        data.items.push({
          type: "file",
          name: `new-file-${count}.md`,
          items: [],
        });

        const absolutePath = join(workspacesPath, ...cleanedPaths);
        await writeFile(
          join(absolutePath, `new-file-${count}.md`),
          "just file",
          "utf-8",
        );

        return true;
      }

      data.items.forEach((item) => {
        if (this.addFile(item, currentLevel + 1, cleanedPaths)) return true;
      });
    }
    return false;
  }

  async addFolder(data: Item, level, cleanedPaths) {
    const currentLevel = level;

    if (data.name === cleanedPaths[level]) {
      if (cleanedPaths.length - 1 === level) {
        const count = data.items.length;
        data.items.push({
          type: "folder",
          name: `new-folder-${count}`,
          items: [],
        });

        const absolutePath = join(workspacesPath, ...cleanedPaths);
        await mkdir(join(absolutePath, `new-folder-${count}`));

        return true;
      }

      data.items.forEach((item) => {
        if (this.addFolder(item, currentLevel + 1, cleanedPaths)) return true;
      });
    }
    return false;
  }

  async isPathExisted(workspaceName: string, relativePath: string) {
    try {
      await access(join(workspacesPath, workspaceName, relativePath), constants.R_OK | constants.W_OK)

      return true;
    } catch (error) {
      return false;
    }
  }

  async saveFile(workspaceName: string, relativePath, content:string) {
    const absolutePath = join(workspacesPath, workspaceName, relativePath)
    return await writeFile(absolutePath, content, "utf-8")
  }

  async renamePath(workspaceName: string, oldRelativePath: string, newRelativePath: string) {
    const oldPath = join(workspacesPath, workspaceName, oldRelativePath);
    const newPath = join(workspacesPath, workspaceName, newRelativePath);

    await rename(oldPath, newPath);
    return await this.findOne(workspaceName);
  }

}   