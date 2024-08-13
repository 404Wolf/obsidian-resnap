import { MarkdownView, Notice, Plugin } from "obsidian";
import { tmpdir } from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { Orientation } from "./types/enums.ts";

import SettingsTab, {
  DEFAULT_SETTINGS,
  type MyPluginSettings,
} from "./settings";
import callReSnap from "./resnap/index.ts";

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    const plugin = this;

    this.addCommand({
      id: "insert-remarkable-drawing",
      name: "Insert a drawing from the reMarkable",
      callback: () => {
        plugin.tryInsertingDrawing(Orientation.PORTRAIT);
      },
    });

    this.addCommand({
      id: "insert-remarkable-drawing-landscape",
      name: "Insert a landscape-format drawing from the reMarkable",
      callback: () => {
        plugin.tryInsertingDrawing(Orientation.LANDSCAPE);
      },
    });

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  loadSettings = async () => {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  };

  saveSettings = async () => {
    await this.saveData(this.settings);
  };

  postprocessDrawing = async (drawingFilePath: string) => {
    const { postprocessor } = this.settings;
    if (postprocessor) {
      const args = [drawingFilePath];
      Bun.spawn([postprocessor, ...args]);
    }
    return true;
  };

  tryInsertingDrawing = async (orientation: Orientation): Promise<void> => {
    new Notice("Inserting rM drawing...", 1000);

    try {
      const fileName = `${crypto.randomUUID()}.png`;
      const outputFilePath = path.join(tmpdir(), fileName);
      await callReSnap(
        this.settings.reSnapPath,
        this.settings.rmSshKeyAddress,
        outputFilePath,
        orientation,
      );

      // Get the vault's root path
      const resourceRoot = this.app.vault.getFolderByPath(
        this.settings.outputPath,
      );
      if (resourceRoot === null)
        throw new Error("Could not find the resource root!");
      console.log("Resource root:", resourceRoot);

      // Copy the image to the vault if it's not already there
      const vaultImagePath = path.join(resourceRoot.path, fileName);
      console.log("Copying drawing to vault:", vaultImagePath);
      //@ts-ignore
      const vaultBasePath = await this.app.vault.adapter.basePath;
      console.log(vaultBasePath);
      const vaultResourceDumpPath = path.join(vaultBasePath, vaultImagePath);
      await fs.copyFile(outputFilePath, vaultResourceDumpPath);
      fs.unlink(outputFilePath)
        .then(() => console.log("Deleted temporary file:", outputFilePath))
        .catch((error) =>
          console.error("Could not delete temporary file:", error),
        );

      // Create the markdown for the image
      const imageMarkdown = `![[${fileName}]]`;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const editor = view.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(imageMarkdown, cursor);
      } else throw new Error("No markdown view found!");
    } catch (error) {
      new Notice(
        "Could not insert your rM drawing! Is your tablet connected " +
          "and reachable at the configured address?",
      );
      throw error;
    }
  };
}
