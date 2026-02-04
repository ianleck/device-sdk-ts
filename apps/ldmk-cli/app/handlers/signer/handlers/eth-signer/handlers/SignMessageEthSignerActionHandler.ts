import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { EthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionHandler";
import {
  EthSignerActionType,
  EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { type AppState } from "@ldmk/app/state/AppState";
import { UserInteractionFormatter } from "@ldmk/app/utils/UserInteractionFormatter";
import {
  DeviceActionIntermediateValue,
  DeviceActionState,
  DeviceActionStatus,
  DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import {
  Signature,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_MESSAGE = "Hello World";

@injectable()
export class SignMessageEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.SIGN_MESSAGE;
  readonly description = "Sign a personal message";
  private lastInteraction = "";

  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(type: EthSignerActionType): boolean {
    return type === this.type;
  }

  public async handle(): Promise<boolean> {
    const signMessageInput = await this.getInput();

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(signMessageInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    derivationPath: string;
    message: string;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const message = await input({
      message: `Message (default: ${DEFAULT_MESSAGE})`,
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      message: message.trim() || DEFAULT_MESSAGE,
      skipOpenApp,
    };
  }

  private executeAndSubscribe(
    params: {
      derivationPath: string;
      message: string;
      skipOpenApp: boolean;
    },
    resolve: (value: boolean) => void,
  ): void {
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signMessage(
      params.derivationPath,
      params.message,
      {
        skipOpenApp: params.skipOpenApp,
      },
    );

    observable.subscribe({
      next: (
        state: DeviceActionState<
          Signature,
          unknown,
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
    state: DeviceActionState<Signature, unknown, DeviceActionIntermediateValue>,
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

  private displayOutput(output: Signature): void {
    console.log(chalk.green("\nMessage signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to sign message!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }

  private async promptYesNo(
    message: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const defaultText = defaultValue ? "yes" : "no";
    const response = await input({
      message: `${message} (yes/no, default: ${defaultText})`,
    });
    if (response.trim() === "") {
      return defaultValue;
    }
    return response.toLowerCase() === "yes" || response.toLowerCase() === "y";
  }
}
