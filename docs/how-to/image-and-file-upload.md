# How-To Guide: Custom Image & File Uploads

This guide shows you how to configure image uploads, file attachments, drag-and-drop media, and clipboard screenshot pasting with your custom backend storage (such as AWS S3, Aliyun OSS, Cloudflare R2, or a custom REST API).

---

## 1. How Image Handling Works in UniLexical

When a user inserts an image (via the toolbar, slash menu `/image`, dragging a file into the editor, or pasting a screenshot with `Ctrl+V` / `Cmd+V`):

1. **Optimistic Preview**: The editor immediately inserts an `ImageNode` with a temporary preview URL and displays a loading state.
2. **Uploader Invocation**:
   - If an `imageOptions.upload` function is configured, UniLexical invokes it with the raw `File` object.
   - Once your promise resolves with a public HTTPS URL string, UniLexical updates the node's `src` and clears the loading state.
3. **Base64 Fallback**: If `upload` is omitted, the image file is automatically read as a base64 Data URL (`data:image/png;base64,...`) and embedded directly into the document.

---

## 2. Implementing a Custom Image Uploader

### Option A: Uploading to a REST API

```ts
import { mountEditor } from 'unilexical';

async function uploadImageToServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/upload/image', {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  // Return the public accessible URL
  return result.data.url;
}

const handle = mountEditor({
  container: '#editor',
  imageOptions: {
    upload: uploadImageToServer,
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
    maxSize: 10 * 1024 * 1024, // 10MB limit
  },
});
```

---

### Option B: Uploading Directly to Cloud Storage (Presigned S3 / OSS)

```ts
async function uploadToS3Presigned(file: File): Promise<string> {
  // 1. Request presigned URL from your server
  const presignRes = await fetch(`/api/s3/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);
  const { uploadUrl, publicUrl } = await presignRes.json();

  // 2. Upload file directly to S3/R2
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error('S3 upload failed');
  }

  return publicUrl;
}
```

---

## 3. Vue 3 Integration

In Vue 3, pass `image-options` directly as a prop to `<UniLexical />`:

```vue
<script setup lang="ts">
import { UniLexical } from 'unilexical/vue';

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  return data.url;
}
</script>

<template>
  <UniLexical
    :image-options="{
      upload: uploadImage,
      accept: 'image/*',
      maxSize: 5 * 1024 * 1024,
    }"
  />
</template>
```

---

## 4. React Integration

In React, pass `imageOptions` as a prop:

```tsx
import { UniLexical } from 'unilexical/react';

export function EditorView() {
  return (
    <UniLexical
      imageOptions={{
        upload: async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          return json.url as string;
        },
        maxSize: 5 * 1024 * 1024,
      }}
    />
  );
}
```

---

## 5. File Attachments

UniLexical also supports generic file attachments (PDFs, ZIPs, spreadsheets) via `attachmentOptions`:

```ts
const handle = mountEditor({
  container: '#editor',
  attachmentOptions: {
    upload: async (file: File) => {
      const formData = new FormData();
      formData.append('attachment', file);
      const res = await fetch('/api/attachments', { method: 'POST', body: formData });
      const json = await res.json();
      return {
        url: json.downloadUrl,
        name: file.name,
      };
    },
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip,.tar.gz',
    maxSize: 50 * 1024 * 1024, // 50MB
  },
});
```

---

## 6. Programmatic Image Insertion

You can also trigger image insertion via code on the `UniEditor` instance:

```ts
// 1. Insert a remote image directly by URL
editor.insertImageUrl('https://example.com/banner.png', 'Banner alt text');

// 2. Insert a File object programmatically (runs through the upload pipeline)
const input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.onchange = () => {
  if (input.files?.[0]) {
    editor.insertImageFile(input.files[0]);
  }
};
input.click();
```
