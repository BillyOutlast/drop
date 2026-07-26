import type { SerializeObject } from "nitropack";
import type { UserModel } from "~/prisma/client/models";
import type { AuthMec } from "~/prisma/client/enums";

// fallow-ignore-next-line unused-export
export const useUsers = () =>
  useState<
    | Array<
        SerializeObject<
          UserModel & {
            authMecs?: Array<{ id: string; mec: AuthMec }>;
          }
        >
      >
    | undefined
  >("users", () => undefined);

// fallow-ignore-next-line unused-export
export const fetchUsers = async () => {
  const users = useUsers();

  const newValue = await $dropFetch("/api/v1/admin/users");
  // @ts-expect-error: API returns authMecs without `id`, but state type requires it
  users.value = newValue;
  return newValue;
};
