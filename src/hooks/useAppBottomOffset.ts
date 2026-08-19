import { useEffect } from "react";

/** Same pocket math as Distress Survey: layout viewport minus visible visual viewport. */
function updateAppBottomOffset() {
  const vv = window.visualViewport;
  const h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight;
  const layoutH = window.innerHeight || document.documentElement.clientHeight || h;
  const bottomOffset = vv ? Math.max(0, layoutH - vv.height - vv.offsetTop) : 0;
  document.documentElement.style.setProperty(
    "--app-bottom-offset",
    `${Math.round(bottomOffset)}px`,
  );
}

/** Keep --app-bottom-offset live for fixed bottom chrome (home trash FAB pocket). */
export function useAppBottomOffset() {
  useEffect(() => {
    updateAppBottomOffset();
    const onUpdate = () => updateAppBottomOffset();
    window.addEventListener("resize", onUpdate);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onUpdate);
    vv?.addEventListener("scroll", onUpdate);
    return () => {
      window.removeEventListener("resize", onUpdate);
      vv?.removeEventListener("resize", onUpdate);
      vv?.removeEventListener("scroll", onUpdate);
      document.documentElement.style.removeProperty("--app-bottom-offset");
    };
  }, []);
}
