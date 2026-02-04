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
  type GetDeviceMetadataDAOutput,
  GetDeviceMetadataDeviceAction,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class GetDeviceMetadataDeviceActionHandler
  implements DeviceActionHandler
{
  readonly type = DeviceActionTypes.GET_DEVICE_METADATA;
  readonly description = "Get device metadata (firmware, apps, updates)";
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
      deviceAction: new GetDeviceMetadataDeviceAction({ input: {} }),
    });

    observable.subscribe({
      next: (
        state: DeviceActionState<
          GetDeviceMetadataDAOutput,
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
      GetDeviceMetadataDAOutput,
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

  private displayOutput(output: GetDeviceMetadataDAOutput): void {
    console.log(chalk.green("\nDevice metadata retrieved successfully!"));
    console.log(chalk.grey(`  Firmware version: ${output.firmwareVersion.os}`));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to get device metadata!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }
}
