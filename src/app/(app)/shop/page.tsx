import { Suspense } from "react";
import { ShopScreen } from "@/components/features/shop/ShopScreen";
import { Spinner } from "@/components/ui/Loading";

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      }
    >
      <ShopScreen />
    </Suspense>
  );
}
