import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { DeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/DeviceActionHandler";
import {
  DeviceActionType,
  DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { AppState } from "@ldmk/app/state/AppState";
import { UserInteractionFormatter } from "@ldmk/app/utils/UserInteractionFormatter";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceManagementKit,
  type DmkError,
  OpenAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class OpenAppDeviceActionHandler implements DeviceActionHandler {
  readonly type = DeviceActionTypes.OPEN_APP;
  readonly description = "Open an application";
  lastInteraction = "";

  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(type: DeviceActionType): boolean {
    return type === this.type;
  }

  public async handle(): Promise<boolean> {
    const appName = await input({ message: "Enter the app name" });

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(appName, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private executeAndSubscribe(
    appName: string,
    resolve: (value: boolean) => void,
  ): void {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new OpenAppDeviceAction({ input: { appName } }),
    });
    observable.subscribe({
      next: (
        state: DeviceActionState<void, DmkError, DeviceActionIntermediateValue>,
      ) => {
        this.handleState(state);
      },
      complete: () => resolve(false),
      error: (err: unknown) => {
        this.displayError(err);
        resolve(true);
      },
    });
  }

  private handleState(
    state: DeviceActionState<void, DmkError, DeviceActionIntermediateValue>,
  ): void {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        this.displayPendingInteraction(
          state.intermediateValue.requiredUserInteraction,
        );
        break;
      case DeviceActionStatus.Completed:
        this.displayOutput();
        break;
      case DeviceActionStatus.Error:
        this.displayError(state.error);
        break;
    }
  }

  private displayPendingInteraction(interaction: string | undefined): void {
    if (!interaction) return;
    const message = UserInteractionFormatter.format(interaction);
    if (message && message !== this.lastInteraction) {
      this.lastInteraction = message;
      console.log(chalk.yellow(message));
    }
  }

  private displayOutput(): void {
    console.log(chalk.green("\nApplication opened successfully!"));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to open application!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }
}
