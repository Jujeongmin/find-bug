import { useEffect } from "react";
import { useVXShop } from "@verse8/platform";
import { useGameServer } from "@agent8/gameserver";
import { sfx } from "../audio/sfx";
import { useI18n } from "../i18n";
import { REMOVE_ADS, loadEntitlements, useAdsRemoved } from "../net/shop";

/**
 * The shop, which has one line in it.
 *
 * Its own file because the platform SDK is thirty kilobytes and it is reached
 * by opening a panel behind a gear in the corner. On the first frame it is
 * thirty kilobytes of till for a game nobody has started playing yet, so it
 * arrives when the panel does.
 *
 * What is sold is the wait, not the reward. The free half hour and the free
 * coffee are unchanged and still one a day each; owning this only means the
 * button that grants them stops costing thirty seconds of advert first. The
 * sentence under the row says so, because a shop line in a game about a
 * working day should not be able to be mistaken for a way to buy a better one.
 */
export function ShopRow() {
  const { t, tp } = useI18n();
  const { server, connected } = useGameServer();
  const adsRemoved = useAdsRemoved();
  const { getItem, buyItem, refresh, onClose } = useVXShop();

  useEffect(() => {
    // the dialogue closing is the only signal a purchase happened, so the
    // account is asked again rather than believed on the client's say-so
    const cancel = onClose((payload) => {
      void refresh();
      if (payload.purchased) void loadEntitlements(connected ? server : null);
    });
    return cancel;
  }, [onClose, refresh, connected, server]);

  const removeAds = getItem(REMOVE_ADS);

  /*
   * Nothing at all when there is nothing to show. A shop that says
   * "unavailable" is worse than a shop that is not there: outside Verse8 there
   * is no till to open, and the adverts it removes are not running either.
   */
  if (!adsRemoved && !removeAds) return null;

  return (
    <>
      <label>{t("settings.shop")}</label>
      {adsRemoved ? (
        <p className="settings-owned">{t("shop.removeAds.owned")}</p>
      ) : (
        <button
          className="settings-buy"
          disabled={!removeAds?.purchasable}
          onClick={() => {
            sfx.play("click");
            buyItem(REMOVE_ADS);
          }}
        >
          <span>{t("shop.removeAds")}</span>
          <em>
            {removeAds?.purchasable
              ? tp("shop.price", { n: String(removeAds.price) })
              : (removeAds?.purchaseBlockReason ?? t("shop.blocked"))}
          </em>
        </button>
      )}
      <p className="settings-note">{t("shop.removeAds.body")}</p>
    </>
  );
}
