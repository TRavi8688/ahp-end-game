import os
import re

dir_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions'
files = [f for f in os.listdir(dir_path) if f.endswith('.py')]

for f in files:
    path = os.path.join(dir_path, f)
    with open(path, 'r') as file:
        lines = file.readlines()
    
    new_lines = []
    for line in lines:
        # Match batch_op.add_column(sa.Column('column_name', sa.Type(), ...))
        # and turn into op.execute(sa.text('ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type'))
        
        # We need the table name which is usually in the previous 'with op.batch_alter_table' line
        # But it's easier to just use a regex that handles common cases
        
        match = re.search(r"batch_op\.add_column\(sa\.Column\('(\w+)', sa\.(\w+)\(.*?\),.*?\)\)", line)
        if match:
            col_name = match.group(1)
            col_type = match.group(2)
            # Find the table name by looking back
            table_name = "unknown"
            for prev_line in reversed(new_lines):
                if "with op.batch_alter_table" in prev_line:
                    table_match = re.search(r"with op\.batch_alter_table\('(\w+)'", prev_line)
                    if table_match:
                        table_name = table_match.group(1)
                        break
            
            if table_name != "unknown":
                # Convert sa.Type to SQL Type (simplistic)
                sql_type = col_type.upper()
                if sql_type == "STRING": sql_type = "VARCHAR(255)"
                if sql_type == "INTEGER": sql_type = "INTEGER"
                if sql_type == "BOOLEAN": sql_type = "BOOLEAN"
                if sql_type == "DATETIME": sql_type = "TIMESTAMP WITH TIME ZONE"
                
                line = f"        op.execute(sa.text('ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {sql_type}'))\n"
        
        new_lines.append(line)

    with open(path, 'w') as file:
        file.writelines(new_lines)

print("All migrations patched with universal IF NOT EXISTS for columns.")
