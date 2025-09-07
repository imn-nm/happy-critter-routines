-- Create rewards table
CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Create policies for rewards
CREATE POLICY "Parents can create rewards for their children" 
ON public.rewards 
FOR INSERT 
WITH CHECK (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can view rewards for their children" 
ON public.rewards 
FOR SELECT 
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can update rewards for their children" 
ON public.rewards 
FOR UPDATE 
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can delete rewards for their children" 
ON public.rewards 
FOR DELETE 
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

-- Add trigger for updating timestamps
CREATE TRIGGER update_rewards_updated_at
BEFORE UPDATE ON public.rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create reward purchases table
CREATE TABLE public.reward_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL,
  reward_id UUID NOT NULL,
  coins_spent INTEGER NOT NULL DEFAULT 0,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE public.reward_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for reward purchases
CREATE POLICY "Parents can create purchases for their children" 
ON public.reward_purchases 
FOR INSERT 
WITH CHECK (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can view purchases for their children" 
ON public.reward_purchases 
FOR SELECT 
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can update purchases for their children" 
ON public.reward_purchases 
FOR UPDATE 
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));