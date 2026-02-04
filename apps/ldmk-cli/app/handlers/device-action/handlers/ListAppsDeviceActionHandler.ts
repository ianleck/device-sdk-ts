import "zx/globals";

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
  type ListAppsDAOutput,
  ListAppsDeviceAction,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class ListAppsDeviceActionHandler implements DeviceActionHandler {
  readonly type = DeviceActionTypes.LIST_APPS;
  readonly description = "List installed apps";
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
    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private executeAndSubscribe(resolve: (value: boolean) => void): void {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new ListAppsDeviceAction({ input: {} }),
    });
    observable.subscribe({
      next: (
        state: DeviceActionState<
          ListAppsDAOutput,
          DmkError,
          DeviceActionIntermediateValue
        >,
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
    state: DeviceActionState<
      ListAppsDAOutput,
      DmkError,
      DeviceActionIntermediateValue
    >,
  ): void {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        this.displayPendingInteraction(
          state.intermediateValue.requiredUserInteraction,
        );
        break;
      case DeviceActionStatus.Completed:
        this.displayOutput(state.output);
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

  private displayOutput(output: ListAppsDAOutput): void {
    console.log(chalk.green("\nInstalled apps:"));
    if (Array.isArray(output)) {
      output.forEach((app) => {
        console.log(chalk.grey(`  - ${app.appName}`));
      });
    }
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to list apps!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }
}
