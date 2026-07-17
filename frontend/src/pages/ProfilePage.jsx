import { useState } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserProfile } from "../lib/api";
import { LANGUAGES } from "../constants";
import { capitialize } from "../lib/utils";
import {
  UserIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
  MapPinIcon,
  BookOpenIcon,
  MessageSquareIcon,
  ShipWheelIcon,
  CheckCircleIcon,
} from "lucide-react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    location: authUser?.location || "",
  });

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to update profile. Please try again.");
    },
  });

  const handleStartEdit = () => {
    // Reset form to current values when opening editor
    setFormData({
      bio: authUser?.bio || "",
      nativeLanguage: authUser?.nativeLanguage || "",
      learningLanguage: authUser?.learningLanguage || "",
      location: authUser?.location || "",
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    saveProfile(formData);
  };

  if (!authUser) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Profile</h1>

        {/* Profile Card */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-6">
            {/* Avatar + Name row */}
            <div className="flex items-center gap-4 mb-4">
              <div className="avatar">
                <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img
                    src={authUser.profilePic}
                    alt={authUser.fullName}
                  />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{authUser.fullName}</h2>
                <p className="text-sm opacity-60 flex items-center gap-1.5 mt-1">
                  <MapPinIcon className="size-3.5" />
                  {authUser.location || "No location set"}
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="btn btn-outline btn-sm gap-2"
                >
                  <PencilIcon className="size-4" />
                  Edit Profile
                </button>
              )}
            </div>

            {/* Info badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {authUser.nativeLanguage && (
                <span className="badge badge-secondary gap-1.5">
                  <ShipWheelIcon className="size-3.5" />
                  Native: {capitialize(authUser.nativeLanguage)}
                </span>
              )}
              {authUser.learningLanguage && (
                <span className="badge badge-outline gap-1.5">
                  <BookOpenIcon className="size-3.5" />
                  Learning: {capitialize(authUser.learningLanguage)}
                </span>
              )}
            </div>

            {/* Bio */}
            {!isEditing && (
              <div className="flex items-start gap-2 text-sm opacity-80">
                <MessageSquareIcon className="size-4 flex-shrink-0 mt-0.5 text-primary" />
                <p>{authUser.bio || "No bio added yet."}</p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-6 space-y-5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <PencilIcon className="size-5 text-primary" />
                Edit Profile
              </h2>

              {/* Bio */}
              <div className="form-control gap-1.5">
                <label className="label py-0">
                  <span className="label-text font-semibold">Bio</span>
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell others about yourself..."
                  className="textarea textarea-bordered w-full resize-none"
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs opacity-50 text-right">{formData.bio.length}/300</p>
              </div>

              {/* Native Language */}
              <div className="form-control gap-1.5">
                <label className="label py-0">
                  <span className="label-text font-semibold">Native Language</span>
                </label>
                <select
                  value={formData.nativeLanguage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nativeLanguage: e.target.value }))
                  }
                  className="select select-bordered w-full"
                >
                  <option value="">Select your native language</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Learning Language */}
              <div className="form-control gap-1.5">
                <label className="label py-0">
                  <span className="label-text font-semibold">Language I'm Learning</span>
                </label>
                <select
                  value={formData.learningLanguage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, learningLanguage: e.target.value }))
                  }
                  className="select select-bordered w-full"
                >
                  <option value="">Select language you're learning</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="form-control gap-1.5">
                <label className="label py-0">
                  <span className="label-text font-semibold">Location</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="e.g. New York, USA"
                  className="input input-bordered w-full"
                  maxLength={100}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="btn btn-primary gap-2 flex-1 sm:flex-none"
                >
                  {isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="btn btn-ghost gap-2 flex-1 sm:flex-none"
                >
                  <XIcon className="size-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Info Section */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <UserIcon className="size-5 text-primary" />
              Account Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-base-300">
                <span className="text-sm opacity-70">Full Name</span>
                <span className="text-sm font-medium">{authUser.fullName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-base-300">
                <span className="text-sm opacity-70">Email</span>
                <span className="text-sm font-medium">{authUser.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-base-300">
                <span className="text-sm opacity-70">Friends</span>
                <span className="text-sm font-medium">{authUser.friends?.length || 0} friends</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm opacity-70">Account Status</span>
                <span className="badge badge-success gap-1.5">
                  <CheckCircleIcon className="size-3.5" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
