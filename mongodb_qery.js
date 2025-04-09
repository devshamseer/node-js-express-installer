const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

// Initialize app
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB (replace 'mongodb://localhost:27017/mydb' with your actual MongoDB URI)
mongoose
  .connect("mongodb://localhost:27017/mydb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Error connecting to MongoDB", err));

// Define Post schema
const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    photo: { type: String, required: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

postSchema.index({ user_id: 1 }); // Indexing user_id for performance

const Post = mongoose.model("Post", postSchema);

// Define User schema
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }); // Indexing email for performance

const User = mongoose.model("User", userSchema);

// Routes

// Create a Post
app.post("/posts", async (req, res) => {
  const { title, description, photo, user_id } = req.body;

  try {
    const post = new Post({ title, description, photo, user_id });
    await post.save();
    res.status(201).json({ message: "Post created", post });
  } catch (err) {
    res.status(400).json({ error: "Error creating post", details: err });
  }
});

// Find Posts (with aggregation and $lookup)
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.aggregate([
      {
        $addFields: {
          user_id: { $toObjectId: "$user_id" }, // apply ObjectId [ ObjectId("dkfjkdjfkdjf") ]
        },
      },
      {
        $lookup: {
          from: "usersList", // The collection to join
          localField: "user_id", // Field from Post collection  // only stirng id "dkfjkdjfkdjf"
          foreignField: "_id", // Field from architects collection
          as: "user_details", // Output array of matched documents
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          photo: 1,
          user_id: 1,
          user_details: {
            // Here we specify which fields we want from the user_details
            name: { $arrayElemAt: ["$user_details.firstName", 0] }, // Extract name from the first element in the array
            email: { $arrayElemAt: ["$user_details.Email", 0] }, // If email exists in the architects collection
          },
        },
      },
    ]);
    res.status(200).json(posts);
  } catch (err) {
    res.status(400).json({ error: "Error fetching posts", details: err });
  }
});

// Update a Post
app.put("/posts/:id", async (req, res) => {
  const postId = req.params.id;
  const updateData = req.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(postId, updateData, {
      new: true,
    });
    if (!updatedPost) return res.status(404).json({ error: "Post not found" });
    res.status(200).json({ message: "Post updated", updatedPost });
  } catch (err) {
    res.status(400).json({ error: "Error updating post", details: err });
  }
});

// Delete a Post
app.delete("/posts/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const deletedPost = await Post.findByIdAndDelete(postId);
    if (!deletedPost) return res.status(404).json({ error: "Post not found" });
    res.status(200).json({ message: "Post deleted", deletedPost });
  } catch (err) {
    res.status(400).json({ error: "Error deleting post", details: err });
  }
});

// Create a User
app.post("/users", async (req, res) => {
  const { firstName, lastName, email } = req.body;

  try {
    const user = new User({ firstName, lastName, email });
    await user.save();
    res.status(201).json({ message: "User created", user });
  } catch (err) {
    res.status(400).json({ error: "Error creating user", details: err });
  }
});






// Create a Post
app.post("/posts", async (req, res) => {
    const { title, description, photo, user_id } = req.body;
  
    try {
      const post = new Post({ title, description, photo, user_id });
      await post.save();
      res.status(201).json({ message: "Post created", post });
    } catch (err) {
      res.status(400).json({ error: "Error creating post", details: err });
    }
  });
  
  // Find Posts with Sorting, Filtering, Pagination, and Aggregation
  app.get("/posts", async (req, res) => {
    const { sortBy = "createdAt", order = "asc", page = 1, limit = 10, min, max } = req.query;
  
    try {
      // Define the filter for description length (min/max) or any other filter
      const filter = {};
      if (min) filter.description = { $gte: parseInt(min) };
      if (max) filter.description = { ...filter.description, $lte: parseInt(max) };
  
      // Aggregation pipeline
      const posts = await Post.aggregate([
        {
          $match: filter, // Filter based on query parameters (min/max)
        },
        {
          $lookup: {
            from: "users", // The collection to join
            localField: "user_id", // Field from Post collection
            foreignField: "_id", // Field from User collection
            as: "user_details", // Output array of matched documents
          },
        },
        {
          $unwind: {
            path: "$user_details", // Flatten the array
            preserveNullAndEmptyArrays: true, // Allow posts without user details
          },
        },
        {
          $project: {
            title: 1,
            description: 1,
            photo: 1,
            user_id: 1,
            user_details: {
              firstName: 1,
              lastName: 1,
              email: 1,
            },
          },
        },
        {
          $sort: {
            [sortBy]: order === "asc" ? 1 : -1, // Sort by the selected field
          },
        },
        {
          $skip: (page - 1) * limit, // Pagination: skip previous pages
        },
        {
          $limit: parseInt(limit), // Limit results per page
        },
      ]);
  
      // Count total posts matching the filter (for pagination)
      const totalPosts = await Post.countDocuments(filter);
  
      res.status(200).json({
        posts,
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit), // Total number of pages
        currentPage: parseInt(page), // Current page
      });
    } catch (err) {
      res.status(400).json({ error: "Error fetching posts", details: err });
    }
  });
  
  // Update a Post
  app.put("/posts/:id", async (req, res) => {
    const postId = req.params.id;
    const updateData = req.body;
  
    try {
      const updatedPost = await Post.findByIdAndUpdate(postId, updateData, {
        new: true,
      });
      if (!updatedPost) return res.status(404).json({ error: "Post not found" });
      res.status(200).json({ message: "Post updated", updatedPost });
    } catch (err) {
      res.status(400).json({ error: "Error updating post", details: err });
    }
  });
  
  // Delete a Post
  app.delete("/posts/:id", async (req, res) => {
    const postId = req.params.id;
  
    try {
      const deletedPost = await Post.findByIdAndDelete(postId);
      if (!deletedPost) return res.status(404).json({ error: "Post not found" });
      res.status(200).json({ message: "Post deleted", deletedPost });
    } catch (err) {
      res.status(400).json({ error: "Error deleting post", details: err });
    }
  });
  
  // Create a User
  app.post("/users", async (req, res) => {
    const { firstName, lastName, email } = req.body;
  
    try {
      const user = new User({ firstName, lastName, email });
      await user.save();
      res.status(201).json({ message: "User created", user });
    } catch (err) {
      res.status(400).json({ error: "Error creating user", details: err });
    }
  });
  


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
