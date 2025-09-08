-- Enable realtime for children table
ALTER TABLE children REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE children;