import type { NavigationItem } from "./types";

export const useCurrentNavigationIndex = (
  navigation: Array<NavigationItem>,
) => {
  const router = useRouter();
  const route = useRoute();

  const currentNavigation = ref(-1);

  /**
   * Determines the navigation item matching the current route.
   *
   * @param to - The route whose path is matched against the navigation prefixes
   * @returns The index of the most specific matching navigation item, or `-1` when no item matches
   */
  function calculateCurrentNavIndex(to: typeof route) {
    const validOptions = navigation
      .map((e, i) => ({ ...e, index: i }))
      .filter((e) => to.fullPath.startsWith(e.prefix));
    const bestOption = validOptions
      .toSorted((a, b) => b.route.length - a.route.length)
      .at(0);

    return bestOption?.index ?? -1;
  }

  currentNavigation.value = calculateCurrentNavIndex(route);

  router.afterEach((to) => {
    currentNavigation.value = calculateCurrentNavIndex(to);
  });

  return currentNavigation;
};
