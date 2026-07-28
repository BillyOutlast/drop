import type { Message } from "@bufbuild/protobuf";
import type { QueryProcessor } from ".";
import type {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";

/**
 * Defines a query processor for the Torrential service message pipeline.
 *
 * Query processors match messages by type and deserialize them into the
 * specified protobuf message type. They can optionally return a response
 * that is automatically wrapped and sent back.
 *
 * @typeParam T - The DropBound (outbound) message type enum.
 * @typeParam K - The TorrentialBound (inbound) message type enum.
 * @typeParam V - The protobuf message class for deserialization.
 * @param opts - The processor configuration including type matchers and handler.
 * @returns The supplied processor configuration.
 */
export function defineQueryProcessor<
  T extends DropBoundType,
  K extends TorrentialBoundType,
  V extends Message,
>(opts: QueryProcessor<T, K, V>) {
  // TORRENTIAL_SERVICE.queryProcessors.set(opts.queryType, opts as any);
  return opts;
}
