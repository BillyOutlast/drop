import type { Message } from "@bufbuild/protobuf";
import type { QueryProcessor } from ".";
import type {
  DropBoundType,
  TorrentialBoundType,
} from "../../proto/torrential/proto/core_pb";

/**
 * Defines a query processor configuration for the Torrential service message pipeline.
 *
 * @typeParam T - The outbound message type.
 * @typeParam K - The inbound message type.
 * @typeParam V - The protobuf message type.
 * @param opts - The query processor configuration.
 * @returns The supplied query processor configuration.
 */
export function defineQueryProcessor<
  T extends DropBoundType,
  K extends TorrentialBoundType,
  V extends Message,
>(opts: QueryProcessor<T, K, V>) {
  // TORRENTIAL_SERVICE.queryProcessors.set(opts.queryType, opts as any);
  return opts;
}
