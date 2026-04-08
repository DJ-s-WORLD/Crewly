import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PasswordInputWithToggle from "@/components/PasswordInputWithToggle";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // After clicking the email link, Supabase session is established via URL tokens.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not update password");
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (!ready) return null;
  if (!hasSession) return <Navigate to="/login" replace />;

  const valid = password.length >= 6 && password === confirm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-card">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background border border-border shadow-sm overflow-hidden">
            <img src="/logo.png" alt="Crewly" className="h-10 w-10 object-contain" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Set a new password</CardTitle>
          <CardDescription>Choose a strong password you’ll remember.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInputWithToggle id="newPassword" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInputWithToggle id="confirmPassword" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-[11px] text-destructive font-medium">Passwords do not match</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={saving || !valid}>
              {saving ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

