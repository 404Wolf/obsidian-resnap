import { Notice, Plugin, Editor, FileSystemAdapter } from "obsidian";

import * as path from "path";
import moment from "moment";
import SettingsTab from "./settings";

interface MyPluginSettings {
  reSnapPath: string;
  invertRemarkableImages: boolean;
  outputPath: string;
  rmAddress: string;
  postprocessor: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  reSnapPath: "",
  invertRemarkableImages: true,
  outputPath: ".",
  rmAddress: "10.11.99.1",
  postprocessor: "",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    const plugin = this;

    this.addCommand({
      id: "insert-remarkable-drawing",
      name: "Insert a drawing from the reMarkable",
      callback: () => {
        plugin.tryInsertingDrawing(false);
      },
    });

    this.addCommand({
      id: "insert-remarkable-drawing-landscape",
      name: "Insert a landscape-format drawing from the reMarkable",
      callback: () => {
        plugin.tryInsertingDrawing(true);
      },
    });

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async postprocessDrawing(drawingFilePath: string) {
    const { postprocessor } = this.settings;
    if (postprocessor) {
      const args = [drawingFilePath];
      Bun.spawn([postprocessor, ...args]);
    }
    return true;
  }

  async tryInsertingDrawing(landscape: boolean) {
    let success = false;
    new Notice("Inserting rM drawing...", 1000);

    try {
      // remember the editor here, so the user could change mode (e.g. preview mode)
      // in the meantime without an error
      const editor = this.editor;
      const { drawingFilePath, drawingFileName } =
        await this.callReSnap(landscape);
      await this.postprocessDrawing(drawingFilePath); // no-op if no postprocessor set

      editor.replaceRange(`![[${drawingFileName}]]`, editor.getCursor());
      new Notice("Inserted your rM drawing!");
      return true;
    } catch (error) {
      new Notice(
        "Could not insert your rM drawing! Is your tablet connected " +
          "and reachable at the configured address?",
      );
      throw error;
      return false;
    }
  }

  /* Taken and adapted from hans/obsidian-citation-plugin. Cheers! */
  get editor(): Editor {
    const view = this.app.workspace.activeLeaf.view;
    try {
      if (view.editMode.type == "source") {
        return view.editor;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /* Taken from hans/obsidian-citation-plugin. Cheers! */
  resolveLibraryPath(rawPath: string): string {
    const vaultRoot =
      this.app.vault.adapter instanceof FileSystemAdapter
        ? this.app.vault.adapter.getBasePath()
        : "/";
    return path.resolve(vaultRoot, rawPath);
  }
}
