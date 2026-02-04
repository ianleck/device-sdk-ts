import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { EthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionHandler";
import {
  EthSignerActionType,
  EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { AppState } from "@ldmk/app/state/AppState";
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
const DEFAULT_CHAIN_ID = 1;

@injectable()
export class SignDelegationAuthorizationEthSignerActionHandler
  implements EthSignerActionHandler
{
  readonly type = EthSignerActionTypes.SIGN_DELEGATION_AUTHORIZATION;
  readonly description = "Sign delegation authorization";
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
    const signDelegationAuthorizationInput = await this.getInput();

    return new Promise<boolean>((resolve) => {
      try {
        this.executeAndSubscribe(signDelegationAuthorizationInput, resolve);
      } catch (error) {
        this.displayError(error);
        resolve(true);
      }
    });
  }

  private async getInput(): Promise<{
    derivationPath: string;
    nonce: number;
    contractAddress: string;
    chainId: number;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const nonceStr = await input({
      message: "Nonce (default: 0)",
    });
    const contractAddress = await input({
      message: "Contract address (default: 0x)",
    });
    const chainIdStr = await input({
      message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
    });

    const nonce = nonceStr.trim() ? parseInt(nonceStr, 10) : 0;
    const chainId = chainIdStr.trim()
      ? parseInt(chainIdStr, 10)
      : DEFAULT_CHAIN_ID;

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      chainId,
      contractAddress: contractAddress.trim() || "0x",
      nonce,
    };
  }

  private executeAndSubscribe(
    params: {
      derivationPath: string;
      nonce: number;
      contractAddress: string;
      chainId: number;
    },
    resolve: (value: boolean) => void,
  ): void {
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signDelegationAuthorization(
      params.derivationPath,
      params.chainId,
      params.contractAddress,
      params.nonce,
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
    console.log(chalk.green("\nDelegation authorization signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private displayError(error: unknown): void {
    console.log(chalk.red("\nFailed to sign delegation authorization!"));
    console.log(
      chalk.red(
        error instanceof Error ? error.message : "Is your device connected?",
      ),
    );
  }
}
