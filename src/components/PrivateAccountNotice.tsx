import { Lock } from "lucide-react";

const PrivateAccountNotice = ({ text }: { text?: string }) => {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 border border-border/50">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">This account is private</p>
      <p className="mt-1 text-xs text-muted-foreground">{text || "Follow to see posts and full profile details."}</p>
    </div>
  );
};

export default PrivateAccountNotice;

