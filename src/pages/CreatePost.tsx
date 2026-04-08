import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatePostUI } from "@/context/CreatePostUIContext";

/** Deep link / bookmark: open create flow then land on feed. */
const CreatePost = () => {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePostUI();

  useEffect(() => {
    openCreatePost();
    navigate("/feed", { replace: true });
  }, [navigate, openCreatePost]);

  return null;
};

export default CreatePost;
