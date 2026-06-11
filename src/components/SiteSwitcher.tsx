import { ShieldCheck, Storefront } from "@phosphor-icons/react";

type SiteSwitcherProps = {
  active: "public" | "admin";
};

function SiteSwitcher({ active }: SiteSwitcherProps) {
  return (
    <nav className="site-switcher" aria-label="Chuyển khu vực">
      <a className="site-switcher-item" data-active={active === "public"} href="/">
        <Storefront aria-hidden="true" weight="duotone" />
        <span>Website</span>
      </a>
      <a className="site-switcher-item" data-active={active === "admin"} href="/admin">
        <ShieldCheck aria-hidden="true" weight="duotone" />
        <span>Admin</span>
      </a>
    </nav>
  );
}

export default SiteSwitcher;
