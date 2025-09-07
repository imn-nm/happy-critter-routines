-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create children table
CREATE TABLE public.children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('owl', 'fox', 'penguin')),
  current_coins INTEGER NOT NULL DEFAULT 0,
  pet_happiness INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'regular', 'flexible')),
  scheduled_time TIME,
  duration INTEGER, -- in minutes
  coins INTEGER NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_days TEXT[], -- array of day names
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task completions table for tracking history
CREATE TABLE public.task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  coins_earned INTEGER NOT NULL DEFAULT 0,
  duration_spent INTEGER, -- actual time spent in minutes
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create task sessions table for tracking active task timers
CREATE TABLE public.task_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_duration INTEGER, -- in seconds
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create RLS policies for children
CREATE POLICY "Parents can view their own children" 
ON public.children 
FOR SELECT 
USING (parent_id = auth.uid());

CREATE POLICY "Parents can create children" 
ON public.children 
FOR INSERT 
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update their own children" 
ON public.children 
FOR UPDATE 
USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete their own children" 
ON public.children 
FOR DELETE 
USING (parent_id = auth.uid());

-- Create RLS policies for tasks
CREATE POLICY "Parents can view tasks for their children" 
ON public.tasks 
FOR SELECT 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can create tasks for their children" 
ON public.tasks 
FOR INSERT 
WITH CHECK (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can update tasks for their children" 
ON public.tasks 
FOR UPDATE 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can delete tasks for their children" 
ON public.tasks 
FOR DELETE 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

-- Create RLS policies for task completions
CREATE POLICY "Parents can view completions for their children" 
ON public.task_completions 
FOR SELECT 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can create completions for their children" 
ON public.task_completions 
FOR INSERT 
WITH CHECK (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

-- Create RLS policies for task sessions
CREATE POLICY "Parents can view sessions for their children" 
ON public.task_sessions 
FOR SELECT 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can create sessions for their children" 
ON public.task_sessions 
FOR INSERT 
WITH CHECK (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can update sessions for their children" 
ON public.task_sessions 
FOR UPDATE 
USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_children_updated_at
    BEFORE UPDATE ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_children_parent_id ON public.children(parent_id);
CREATE INDEX idx_tasks_child_id ON public.tasks(child_id);
CREATE INDEX idx_task_completions_child_id ON public.task_completions(child_id);
CREATE INDEX idx_task_completions_date ON public.task_completions(date);
CREATE INDEX idx_task_sessions_child_id ON public.task_sessions(child_id);
CREATE INDEX idx_task_sessions_active ON public.task_sessions(is_active);