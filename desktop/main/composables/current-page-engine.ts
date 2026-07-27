import type { RouteLocationNormalized } from "vue-router";
import type { NavigationItem } from "~/types";

export const useCurrentNavigationIndex = (
  navigation: Array<NavigationItem>
) => {
  const router = useRouter();
  const route = useRoute();

  const currentNavigation = ref(-1);

  /**
   * Determines the navigation item that best matches a route.
   *
   * @param to - The route whose path is matched against the navigation prefixes
   * @returns The index of the longest matching navigation route, or `-1` when no route matches
   */
  function calculateCurrentNavIndex(to: RouteLocationNormalized) {
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

  return {currentNavigation, recalculateNavigation: () => {
    currentNavigation.value = calculateCurrentNavIndex(route);
  }};
};
